import { CfnOutput } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  ApplicationLogLevel,
  Architecture,
  LoggingFormat,
  Runtime,
  SystemLogLevel,
} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Trigger } from "aws-cdk-lib/triggers";
import { Construct } from "constructs";
import { LoadTestDashboard } from "./core/Dashboard";
import { Executor } from "./core/Executor";
import { K6Container } from "./core/K6Container";
import { LoadTestInfrastructure } from "./core/LoadTestInfrastructure";
import { InfrastructureConfig, LoadTestConfig } from "./types";
import path from "path";

interface K6LoadTestProps {
  infrastructureConfig: InfrastructureConfig;
  loadTestConfig: LoadTestConfig;
}

export class K6LoadTest extends Construct {
  constructor(scope: Construct, id: string, props: K6LoadTestProps) {
    super(scope, id);
    const { infrastructureConfig, loadTestConfig } = props;
    const loadTestInfrastructure = new LoadTestInfrastructure(
      scope,
      "LoadTestInfrastructure",
      infrastructureConfig,
    );
    const k6Container = new K6Container(scope, "K6Container", {
      ...loadTestConfig,
      otelVersion: infrastructureConfig.otelVersion,
      memoryReservationMiB: infrastructureConfig.memoryReservationMiB,
      vpc: infrastructureConfig.vpc,
    });

    const loadTestExecutor = new Executor(scope, "LoadTestExecutor", {
      cluster: loadTestInfrastructure.cluster,
      asg: loadTestInfrastructure.asg,
      taskDefinition: k6Container.taskDefinition,
      timeout: infrastructureConfig.timeout,
      parallelism: loadTestConfig.parallelism || 1,
      assignPublicIp: !infrastructureConfig.vpc,
    });

    new LoadTestDashboard(scope, "LoadTestDashboard", {
      serviceName: loadTestConfig.serviceName,
    });

    this.triggerLoadTest(scope, loadTestExecutor.stateMachine.stateMachineArn, [
      loadTestExecutor,
    ]);

    new CfnOutput(this, "StateMachineArn", {
      key: "StateMachineArn",
      value: loadTestExecutor.stateMachine.stateMachineArn,
      description: "The ARN of the state machine that executes the load test",
    });
  }

  private triggerLoadTest(
    scope: Construct,
    stateMachineArn: string,
    executeAfter: Construct[],
  ) {
    new Trigger(scope, "Trigger", {
      executeOnHandlerChange: false,
      handler: new NodejsFunction(scope, "k6-executor", {
        entry: path.resolve(__dirname, "./functions/workflow/triggerSfn.js"),
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
