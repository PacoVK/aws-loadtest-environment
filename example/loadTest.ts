import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { InstanceClass, InstanceSize, InstanceType } from "aws-cdk-lib/aws-ec2";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import { K6LoadTest } from "../lib/K6LoadTest";

export class LoadTest extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new K6LoadTest(this, "K6LoadTest", {
      loadTestConfig: {
        serviceName: "my-app",
        image: ContainerImage.fromRegistry("grafana/k6"),
        entrypoint: "tests/loadtest.ts",
        vus: this.node.tryGetContext("vus") ?? 5,
        duration: this.node.tryGetContext("duration") ?? "120s",
        parallelism: this.node.tryGetContext("parallelism") ?? 1,
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
  }
}
