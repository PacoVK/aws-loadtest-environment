import { Construct } from "constructs";
import {
  Compatibility,
  ContainerDependencyCondition,
  ContainerImage,
  LogDriver,
  NetworkMode,
  Scope,
  Secret,
  TaskDefinition,
  UlimitName,
} from "aws-cdk-lib/aws-ecs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { InfrastructureConfig, LoadTestConfig, VcsProvider } from "../types";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import path from "path";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LoadTestDashboard } from "./Dashboard";

type K6ContainerProps = LoadTestConfig & Partial<InfrastructureConfig>;

export class K6Container extends Construct {
  readonly taskDefinition: TaskDefinition;

  constructor(scope: Construct, id: string, config: K6ContainerProps) {
    super(scope, id);
    const secrets = this.buildSecretsDefinitions(config.secrets || {});
    this.taskDefinition = this.buildTaskDefinition(config, secrets);
  }

  private buildSecretsDefinitions(secretParams: { [key: string]: string }) {
    const secrets: { [key: string]: Secret } = {};
    for (const [key, value] of Object.entries(secretParams)) {
      secrets[key] = Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(
          this,
          `Secret-${key}`,
          {
            parameterName: value,
          },
        ),
      );
    }
    return secrets;
  }

  private buildTaskDefinition(
    config: K6ContainerProps,
    secrets: { [key: string]: Secret },
  ) {
    const TEST_SOURCE_DIR = "/tests";
    const group = new LogGroup(this, "k6-log-group", {
      retention: RetentionDays.ONE_DAY,
    });
    const taskDefinition = new TaskDefinition(this, "k6-task", {
      compatibility: Compatibility.EC2,
      networkMode: config.vpc ? NetworkMode.AWS_VPC : NetworkMode.BRIDGE,
      volumes: [
        {
          name: "k6-test-source",
          dockerVolumeConfiguration: {
            scope: Scope.TASK,
            driver: "local",
          },
        },
      ],
    });

    const initContainer = taskDefinition.addContainer("k6-sidecar", {
      image: ContainerImage.fromAsset(
        path.resolve(__dirname, "../../docker/init"),
      ),
      cpu: 256,
      memoryLimitMiB: 512,
      essential: false,
      environment: {
        TARGET_DIR: TEST_SOURCE_DIR,
        REPO_URL: config.repository.httpsCloneUrl,
        VCS_HOST:
          config.repository.vcsProvider?.host || VcsProvider.GITHUB.host,
      },
      logging: LogDriver.awsLogs({
        streamPrefix: "loadtest-init",
        logGroup: group,
      }),
      secrets: {
        ACCESS_TOKEN: Secret.fromSsmParameter(
          StringParameter.fromSecureStringParameterAttributes(
            this,
            "AccessToken",
            {
              parameterName: config.repository.accessTokenSecretName,
            },
          ),
        ),
      },
    });

    initContainer.addMountPoints({
      containerPath: TEST_SOURCE_DIR,
      sourceVolume: "k6-test-source",
      readOnly: false,
    });

    const k6 = taskDefinition.addContainer("k6-container", {
      image: config.image,
      containerName: "k6",
      command: [
        "run",
        "-o",
        "experimental-opentelemetry",
        ...(config.extraArgs || []),
        path.resolve(TEST_SOURCE_DIR, config.entrypoint),
      ],
      memoryReservationMiB: config.memoryReservationMiB,
      secrets,
      environment: {
        K6_VUS: `${config.vus}`,
        K6_DURATION: config.duration,
        K6_OTEL_GRPC_EXPORTER_INSECURE: "true",
        K6_OTEL_GRPC_EXPORTER_ENDPOINT: `${config.vpc ? "localhost" : "otel-collector"}:4317`,
        ...config.environmentVars,
      },
      systemControls: [
        {
          namespace: "net.ipv4.ip_local_port_range",
          value: "1024 65535",
        },
        {
          namespace: "net.ipv4.tcp_tw_reuse",
          value: "1",
        },
        {
          namespace: "net.ipv4.tcp_timestamps",
          value: "1",
        },
      ],
      ulimits: [
        {
          name: UlimitName.NOFILE,
          softLimit: 250000,
          hardLimit: 250000,
        },
      ],
      privileged: true,
      logging: LogDriver.awsLogs({
        streamPrefix: "loadtest-executor",
        logGroup: group,
      }),
    });

    k6.addContainerDependencies({
      container: initContainer,
      condition: ContainerDependencyCondition.SUCCESS,
    });

    k6.addMountPoints({
      containerPath: TEST_SOURCE_DIR,
      sourceVolume: "k6-test-source",
      readOnly: true,
    });

    const collector = taskDefinition.addContainer("otel-collector", {
      containerName: "otel-collector",
      hostname: config.vpc ? undefined : "otel-collector",
      image: ContainerImage.fromAsset(
        path.resolve(__dirname, "../../docker/otel"),
        {
          buildArgs: {
            COLLECTOR_VERSION: config.otelVersion || "latest",
          },
        },
      ),
      essential: false,
      cpu: 512,
      memoryLimitMiB: 512,
      environment: {
        SERVICE_NAME: config.serviceName,
        HOST_NAME: config.vpc ? "localhost" : "otel-collector",
        METRIC_NAMESPACE: LoadTestDashboard.METRIC_NAMESPACE,
      },
      portMappings: [
        {
          containerPort: 4317,
          hostPort: 4317,
        },
      ],
      logging: LogDriver.awsLogs({
        streamPrefix: "otel-collector",
        logGroup: group,
      }),
    });

    if (!config.vpc) {
      k6.addLink(collector);
    }

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "logs:PutLogEvents",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
        ],
        resources: ["*"],
      }),
    );
    return taskDefinition;
  }
}
