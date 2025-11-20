import * as cdk from "aws-cdk-lib/core";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as path from "path";
import { Construct } from "constructs";

export interface AlbJwtStackProps extends cdk.StackProps {
  certificateArn: string;
}

export class AlbJwtStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AlbJwtStackProps) {
    super(scope, id, props);

    // Cognito
    this.userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { username: true },
    });

    this.userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    const tenants = [
      { name: "A", groupName: "tenant-A", precedence: 1 },
      { name: "B", groupName: "tenant-B", precedence: 2 },
    ];

    tenants.forEach(({ groupName, precedence }) => {
      new cognito.UserPoolGroup(this, `Tenant${groupName}Group`, {
        userPool: this.userPool,
        groupName,
        precedence,
      });
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });

    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;

    new cdk.CfnOutput(this, "JwksEndpoint", {
      value: `${issuer}/.well-known/jwks.json`,
    });

    new cdk.CfnOutput(this, "JwtIssuer", { value: issuer });

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
    });

    // Lambda Functions and Target Groups
    const lambdaCode = lambda.Code.fromAsset(
      path.join(__dirname, "../../lambda-hono/dist")
    );

    const tenantResources = tenants.map(({ name, groupName }) => {
      const fn = new lambda.Function(this, `HonoFunction${name}`, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambdaCode,
        timeout: cdk.Duration.seconds(30),
        environment: {
          TENANT_ID: groupName,
        },
      });

      const targetGroup = new elbv2.ApplicationTargetGroup(
        this,
        `TargetGroup${name}`,
        {
          vpc,
          targetType: elbv2.TargetType.LAMBDA,
          targets: [new targets.LambdaTarget(fn)],
        }
      );

      return { name, groupName, fn, targetGroup };
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
    });

    // Allow ALB to access JWKS endpoint
    alb.connections.allowToAnyIpv4(
      ec2.Port.tcp(443),
      "Allow HTTPS to JWKS endpoint"
    );

    // Certificate
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      props.certificateArn
    );

    // HTTPS Listener
    const listener = alb.addListener("Listener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(403, {
        contentType: "text/plain",
        messageBody: "Forbidden",
      }),
    });

    // Grant ALB permission to invoke Lambda and create listener rules
    const jwksEndpoint = `${issuer}/.well-known/jwks.json`;

    tenantResources.forEach(({ name, groupName, fn, targetGroup }, index) => {
      fn.addPermission(`AllowALBInvoke${name}`, {
        principal: new iam.ServicePrincipal(
          "elasticloadbalancing.amazonaws.com"
        ),
        action: "lambda:InvokeFunction",
        sourceArn: targetGroup.targetGroupArn,
      });

      new elbv2.CfnListenerRule(this, `JwtRuleTenant${name}`, {
        listenerArn: listener.listenerArn,
        priority: (index + 1) * 10,
        conditions: [
          {
            field: "path-pattern",
            pathPatternConfig: {
              values: [`/${groupName}/*`],
            },
          },
        ],
        actions: [
          {
            type: "jwt-validation",
            order: 1,
            jwtValidationConfig: {
              issuer,
              jwksEndpoint,
              additionalClaims: [
                {
                  format: "string-array",
                  name: "cognito:groups",
                  values: [groupName],
                },
              ],
            },
          },
          {
            type: "forward",
            order: 2,
            forwardConfig: {
              targetGroups: [
                {
                  targetGroupArn: targetGroup.targetGroupArn,
                },
              ],
            },
          },
        ],
        transforms: [
          {
            type: "url-rewrite",
            urlRewriteConfig: {
              rewrites: [
                {
                  regex: `^/${groupName}/(.*)$`,
                  replace: "/$1",
                },
              ],
            },
          },
        ],
      });
    });

    new cdk.CfnOutput(this, "ALBDnsName", {
      value: alb.loadBalancerDnsName,
    });
  }
}
