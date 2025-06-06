import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { InstanceClass, InstanceSize, InstanceType } from "aws-cdk-lib/aws-ec2";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";
import { Duration } from "aws-cdk-lib";
import { K6LoadTest } from "../lib";
import {
  LoadTestConfig,
  VcsProvider,
  InfrastructureConfig,
} from "../lib/types";

describe("K6LoadTest", () => {
  test("creates the expected resources", () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, "TestStack");

    const loadTestConfig: LoadTestConfig = {
      serviceName: "test-service",
      image: ContainerImage.fromRegistry("grafana/k6"),
      entrypoint: "tests/loadtest.ts",
      vus: 10,
      duration: "5m",
      parallelism: 2,
      repository: {
        httpsCloneUrl: "https://github.com/user/repo.git",
        accessTokenSecretName: "github-token",
        vcsProvider: VcsProvider.GITHUB,
      },
      environmentVars: {
        BASE_URL: "https://api.example.com",
      },
    };

    const infrastructureConfig: InfrastructureConfig = {
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
      timeout: Duration.minutes(30),
      memoryReservationMiB: 1024,
      otelVersion: "0.123.0",
    };

    // WHEN
    new K6LoadTest(stack, "K6LoadTest", {
      loadTestConfig,
      infrastructureConfig,
    });

    // THEN
    const template = Template.fromStack(stack);

    // Verify VPC is created
    template.resourceCountIs("AWS::EC2::VPC", 1);

    // Verify ECS Cluster is created
    template.resourceCountIs("AWS::ECS::Cluster", 1);

    // Verify Auto Scaling Group is created
    template.resourceCountIs("AWS::AutoScaling::AutoScalingGroup", 1);

    // Verify Task Definition is created
    template.resourceCountIs("AWS::ECS::TaskDefinition", 1);

    // Verify Step Functions State Machine is created
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 1);

    // Verify CloudWatch Dashboard is created
    template.resourceCountIs("AWS::CloudWatch::Dashboard", 1);
  });
});
