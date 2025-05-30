import { Construct } from "constructs";
import {
  Choice,
  Condition,
  IChainable,
  Wait,
  WaitTime,
} from "aws-cdk-lib/aws-stepfunctions";
import { Duration } from "aws-cdk-lib";
import { CallAwsService } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { AutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";

type SfnAsgAutoScalerProps = {
  asg: AutoScalingGroup;
};

export class SfnAsgAutoScaler extends Construct {
  private readonly ASG: AutoScalingGroup;

  constructor(scope: Construct, id: string, props: SfnAsgAutoScalerProps) {
    super(scope, id);
    this.ASG = props.asg;
  }

  setDesiredAsgCapacityTask(id: string, capacity: number, next: IChainable) {
    return this.scaleASGTask(id, capacity, next);
  }

  private scaleASGTask(id: string, capacity: number, next: IChainable) {
    const waitForAsg = new Wait(this, `WaitForAsg${id}`, {
      time: WaitTime.duration(Duration.seconds(5)),
      stateName: `Wait for ASG to scale-${id}`,
    });
    return CallAwsService.jsonata(this, `Scale${id}ASG`, {
      stateName: `Scale-${id}`,
      service: "autoscaling",
      action: "updateAutoScalingGroup",
      parameters: {
        AutoScalingGroupName: this.ASG.autoScalingGroupName,
        DesiredCapacity: capacity,
        MaxSize: capacity,
      },
      iamResources: [this.ASG.autoScalingGroupArn],
    })
      .next(waitForAsg)
      .next(
        CallAwsService.jsonata(this, `DescribeAsgCapacity${id}`, {
          stateName: `Check ECS Capacity after scale-${id}`,
          service: "ecs",
          action: "listContainerInstances",
          parameters: {
            Cluster: "k6-cluster",
          },
          iamResources: ["*"],
          outputs: {
            capacity: "{% $count($states.result.ContainerInstanceArns) %}",
          },
        }),
      )
      .next(
        new Choice(this, `IsAsgCapacity${id}`, {
          stateName: `Scale-${id} done?`,
        })
          .when(
            Condition.jsonata(`{% $states.input.capacity = ${capacity} %}`),
            next,
          )
          .otherwise(waitForAsg),
      );
  }
}
