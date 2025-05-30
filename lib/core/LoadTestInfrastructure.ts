import { Construct } from "constructs";
import {
  AmiHardwareType,
  Cluster,
  ContainerInsights,
  EcsOptimizedImage,
} from "aws-cdk-lib/aws-ecs";
import { AutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";
import { InfrastructureConfig } from "../types";
import {
  IpAddresses,
  IpCidr,
  SubnetV2,
  VpcV2 as Vpc,
} from "@aws-cdk/aws-ec2-alpha";
import { SubnetType } from "aws-cdk-lib/aws-ec2";

export class LoadTestInfrastructure extends Construct {
  readonly cluster: Cluster;
  readonly asg: AutoScalingGroup;

  constructor(scope: Construct, id: string, config: InfrastructureConfig) {
    super(scope, id);
    this.cluster = new Cluster(this, "k6-cluster", {
      clusterName: "k6-cluster",
      containerInsightsV2: ContainerInsights.ENABLED,
      vpc: config.vpc || this.bootstrapVPC(),
    });
    this.asg = this.cluster.addCapacity("k6-capacity", {
      machineImage: EcsOptimizedImage.amazonLinux2023(AmiHardwareType.ARM),
      instanceType: config.instanceType,
      minCapacity: 0,
      maxCapacity: 1,
      desiredCapacity: 0,
      allowAllOutbound: true,
      vpcSubnets: {
        subnetType: config.vpc
          ? SubnetType.PRIVATE_WITH_EGRESS
          : SubnetType.PUBLIC,
      },
    });
  }

  private bootstrapVPC() {
    const vpc = new Vpc(this, "Vpc", {
      primaryAddressBlock: IpAddresses.ipv4("10.9.8.0/25"),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      vpcName: "loadtest-vpc",
    });
    new SubnetV2(this, "PublicSubnet1", {
      subnetType: SubnetType.PUBLIC,
      availabilityZone: vpc.availabilityZones[0],
      ipv4CidrBlock: new IpCidr("10.9.8.0/27"),
      mapPublicIpOnLaunch: true,
      vpc,
    });
    new SubnetV2(this, "PublicSubnet2", {
      subnetType: SubnetType.PUBLIC,
      availabilityZone: vpc.availabilityZones[1],
      ipv4CidrBlock: new IpCidr("10.9.8.32/27"),
      mapPublicIpOnLaunch: true,
      vpc,
    });
    new SubnetV2(this, "PrivateSubnet1", {
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      availabilityZone: vpc.availabilityZones[0],
      ipv4CidrBlock: new IpCidr("10.9.8.64/27"),
      vpc,
    });
    vpc.addInternetGateway();
    return vpc;
  }
}
