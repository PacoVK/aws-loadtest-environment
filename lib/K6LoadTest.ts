import { Construct } from "constructs";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { LoadTestInfrastructure } from "./core/LoadTestInfrastructure";
import { K6Container } from "./core/K6Container";
import { Trigger } from "aws-cdk-lib/triggers";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Executor } from "./core/Executor";
import {
  ApplicationLogLevel,
  Architecture,
  LoggingFormat,
  Runtime,
  SystemLogLevel,
} from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { InfrastructureConfig, LoadTestConfig } from "./types";
import { LoadTestDashboard } from "./core/Dashboard";

interface K6LoadTestProps extends StackProps {
  infrastructureConfig: InfrastructureConfig;
  loadTestConfig: LoadTestConfig;
}

export class K6LoadTest extends Stack {
  constructor(scope: Construct, id: string, props: K6LoadTestProps) {
    super(scope, id, props);
    const { infrastructureConfig, loadTestConfig } = props;
    const loadTestInfrastructure = new LoadTestInfrastructure(
      this,
      "LoadTestInfrastructure",
      infrastructureConfig,
    );
    const k6Container = new K6Container(this, "K6Container", {
      ...loadTestConfig,
      otelVersion: infrastructureConfig.otelVersion,
      memoryReservationMiB: infrastructureConfig.memoryReservationMiB,
      vpc: infrastructureConfig.vpc,
    });

    const loadTestExecutor = new Executor(this, "LoadTestExecutor", {
      cluster: loadTestInfrastructure.cluster,
      asg: loadTestInfrastructure.asg,
      taskDefinition: k6Container.taskDefinition,
      timeout: infrastructureConfig.timeout,
      parallelism: loadTestConfig.parallelism || 1,
      assignPublicIp: !infrastructureConfig.vpc,
    });

    new LoadTestDashboard(this, "LoadTestDashboard", {
      serviceName: loadTestConfig.serviceName,
    });

    this.triggerLoadTest(loadTestExecutor.stateMachine.stateMachineArn, [
      loadTestExecutor,
    ]);

    new CfnOutput(this, "StateMachineArn", {
      key: "StateMachineArn",
      value: loadTestExecutor.stateMachine.stateMachineArn,
      description: "The ARN of the state machine that executes the load test",
    });
  }

  private triggerLoadTest(stateMachineArn: string, executeAfter: Construct[]) {
    new Trigger(this, "Trigger", {
      executeOnHandlerChange: false,
      handler: new NodejsFunction(this, "k6-executor", {
        entry: "./functions/workflow/triggerSfn.ts",
        environment: {
          STATE_MACHINE_ARN: stateMachineArn,
        },
        applicationLogLevelV2: ApplicationLogLevel.INFO,
        loggingFormat: LoggingFormat.JSON,
        systemLogLevelV2: SystemLogLevel.INFO,
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        initialPolicy: [
          new PolicyStatement({
            sid: "InvokeStepFunctions",
            effect: Effect.ALLOW,
            actions: ["states:StartExecution"],
            resources: [stateMachineArn],
          }),
        ],
      }),
      executeAfter,
    });
  }
}
