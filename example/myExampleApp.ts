#!/usr/bin/env node

import { App } from "aws-cdk-lib";
import { LoadTest } from "./loadTest";

const app = new App();

new LoadTest(app, "AnotherTestStack");
