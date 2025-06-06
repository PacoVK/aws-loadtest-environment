import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});

const { STATE_MACHINE_ARN: stateMachineArn } = process.env;

if (!stateMachineArn) {
  throw new Error("STATE_MACHINE_ARN environment variable is required");
}

export const handler = async () => {
  return await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn,
    }),
  );
};
