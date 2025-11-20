import * as cdk from "aws-cdk-lib/core";
import { Template } from "aws-cdk-lib/assertions";
import * as Cdk from "../lib/alb-jwt-stack";

beforeAll(() => {
  process.env.CERTIFICATE_ARN =
    "arn:aws:acm:us-east-1:123456789012:certificate/test";
});

test("Cognito UserPool Created", () => {
  const app = new cdk.App();
  const stack = new Cdk.AlbJwtStack(app, "TestStack", {
    certificateArn: process.env.CERTIFICATE_ARN!,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::Cognito::UserPool", {
    UserPoolName: "my-user-pool",
  });
});

test("Cognito UserPoolClient Created", () => {
  const app = new cdk.App();
  const stack = new Cdk.AlbJwtStack(app, "TestStack", {
    certificateArn: process.env.CERTIFICATE_ARN!,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    ExplicitAuthFlows: [
      "ALLOW_USER_PASSWORD_AUTH",
      "ALLOW_USER_SRP_AUTH",
      "ALLOW_REFRESH_TOKEN_AUTH",
    ],
  });
});
