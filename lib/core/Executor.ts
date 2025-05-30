import { Construct } from "constructs";
import {
  Chain,
  DefinitionBody,
  Fail,
  IntegrationPattern,
  Map,
  ProvideItems,
  QueryLanguage,
  StateMachine,
  Succeed,
} from "aws-cdk-lib/aws-stepfunctions";
import {
  EcsEc2LaunchTarget,
  EcsRunTask,
} from "aws-cdk-lib/aws-stepfunctions-tasks";
import {
  ICluster,
  PlacementConstraint,
  PlacementStrategy,
  PropagatedTagSource,
  TaskDefinition,
} from "aws-cdk-lib/aws-ecs";
import { SfnAsgAutoScaler } from "./SfnAsgAutoScaler";
import { Duration } from "aws-cdk-lib";
import { AutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";

type ExecutorProps = {
  cluster: ICluster;
  asg: AutoScalingGroup;
  taskDefinition: TaskDefinition;
  timeout: Duration;
  parallelism: number;
  assignPublicIp: boolean;
};

export class Executor extends Construct {
  readonly stateMachine: StateMachine;
  private readonly asgAutoScaler: SfnAsgAutoScaler;

  constructor(scope: Construct, id: string, props: ExecutorProps) {
    super(scope, id);
    const {
      cluster,
      asg,
      taskDefinition,
      timeout,
      parallelism,
      assignPublicIp,
    } = props;
    this.asgAutoScaler = new SfnAsgAutoScaler(this, "AsgAutoScaler", {
      asg,
    });
    const executorChain = Chain.start(
      this.asgAutoScaler.setDesiredAsgCapacityTask(
        "Out",
        parallelism,
        this.launchEcsTask(
          cluster,
          taskDefinition,
          parallelism,
          assignPublicIp,
        ).next(
          this.asgAutoScaler.setDesiredAsgCapacityTask(
            "In",
            0,
            new Succeed(this, "Succeed"),
          ),
        ),
      ),
    );

    this.stateMachine = new StateMachine(this, "ExecutorStateMachine", {
      stateMachineName: "LoadTestExecutor",
      comment: "Executes a load test",
      queryLanguage: QueryLanguage.JSONATA,
      definitionBody: DefinitionBody.fromChainable(executorChain),
      timeout,
    });
  }

  private launchEcsTask(
    cluster: ICluster,
    taskDefinition: TaskDefinition,
    parallelism: number,
    assignPublicIp: boolean,
  ) {
    return new Map(this, "DistributedLoadTest", {
      maxConcurrency: parallelism,
      items: ProvideItems.jsonata(`{% [1..${parallelism}] %}`),
    })
      .itemProcessor(
        EcsRunTask.jsonata(this, "RunLoadTest", {
          stateName: "Run Load Test",
          integrationPattern: IntegrationPattern.RUN_JOB,
          cluster,
          taskDefinition,
          assignPublicIp,
          launchTarget: new EcsEc2LaunchTarget({
            placementStrategies: [PlacementStrategy.spreadAcrossInstances()],
            placementConstraints: [PlacementConstraint.distinctInstances()],
          }),
          propagatedTagSource: PropagatedTagSource.TASK_DEFINITION,
        }),
      )
      .addCatch(
        this.asgAutoScaler.setDesiredAsgCapacityTask(
          "Cleanup",
          0,
          new Fail(this, "Fail"),
        ),
      );
  }
}
