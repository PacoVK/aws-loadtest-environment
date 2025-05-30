import { Duration } from "aws-cdk-lib";
import { InstanceType, IVpc } from "aws-cdk-lib/aws-ec2";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";

type Vcs = {
  host: string;
};

enum VcsProviderType {
  GITHUB = "GITHUB",
  GITLAB = "GITLAB",
}

export const VcsProvider: Record<VcsProviderType, Vcs> = {
  [VcsProviderType.GITHUB]: {
    host: "github.com",
  },
  [VcsProviderType.GITLAB]: {
    host: "gitlab.com",
  },
};

export interface LoadTestConfig {
  serviceName: string;
  entrypoint: string;
  repository: {
    httpsCloneUrl: string;
    accessTokenSecretName: string;
    vcsProvider?: Vcs;
  };
  vus: number;
  duration: string;
  image: ContainerImage;
  parallelism?: number;
  secrets?: {
    [key: string]: string;
  };
  environmentVars?: { [key: string]: string };
  extraArgs?: string[];
}

export interface InfrastructureConfig {
  instanceType: InstanceType;
  timeout: Duration;
  memoryReservationMiB: number;
  otelVersion?: string | undefined;
  vpc?: IVpc | undefined;
}
