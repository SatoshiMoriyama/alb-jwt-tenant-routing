#!/usr/bin/env node
import "dotenv/config";
import * as cdk from "aws-cdk-lib/core";
import { AlbJwtStack } from "../lib/alb-jwt-stack";

const app = new cdk.App();

const certificateArn =
  app.node.tryGetContext("certificateArn") || process.env.CERTIFICATE_ARN;

if (!certificateArn) {
  throw new Error(
    "CERTIFICATE_ARN is required. Set it in .env file or pass via context."
  );
}

new AlbJwtStack(app, "AlbJwtStack", {
  env: { region: "ap-northeast-1" },
  certificateArn,
});
