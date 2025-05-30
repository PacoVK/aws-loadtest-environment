#!/usr/bin/env node

import { App, Duration } from "aws-cdk-lib";
import { K6LoadTest } from "../lib/K6LoadTest";
import { InstanceClass, InstanceSize, InstanceType } from "aws-cdk-lib/aws-ec2";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";

const app = new App();

new K6LoadTest(app, "K6LoadTest", {
  loadTestConfig: {
    serviceName: "my-app",
    image: ContainerImage.fromRegistry("grafana/k6"),
    entrypoint: "tests/loadtest.ts",
    vus: app.node.tryGetContext("vus") ?? 5,
    duration: app.node.tryGetContext("duration") ?? "120s",
    parallelism: app.node.tryGetContext("parallelism") ?? 1,
    repository: {
      httpsCloneUrl: "<https-git-clone-url>",
      accessTokenSecretName: "loadtest-gitlab-token",
    },
  },
  infrastructureConfig: {
    otelVersion: "0.123.0",
    instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
    timeout: Duration.minutes(30),
    memoryReservationMiB: 1024,
  },
});
