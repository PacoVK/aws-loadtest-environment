import { Construct } from "constructs";
import {
  Dashboard,
  GaugeWidget,
  GraphWidget,
  IWidget,
  Metric,
  PeriodOverride,
  SingleValueWidget,
} from "aws-cdk-lib/aws-cloudwatch";
import { Duration } from "aws-cdk-lib";

type DashboardProps = {
  serviceName: string;
};

export class LoadTestDashboard extends Construct {
  static METRIC_NAMESPACE = "LOADTEST/K6";
  static SERVICE_NAME: string;

  protected readonly dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: DashboardProps) {
    super(scope, id);
    LoadTestDashboard.SERVICE_NAME = props.serviceName;
    this.dashboard = new Dashboard(this, "LoadTestDashboard", {
      dashboardName: "LoadTestDashboard",
      defaultInterval: Duration.seconds(10),
      periodOverride: PeriodOverride.AUTO,
    });
    const widgets = this.buildWidgetsWithPositions();
    this.dashboard.addWidgets(...widgets);
  }

  buildWidgetsWithPositions(): IWidget[] {
    const vus = new K6Metric("vus", "sum");
    const httpRequestDuration = new K6Metric("http_req_duration", "avg");
    const dataReceived = new K6Metric("data_received", "sum");
    const dataSend = new K6Metric("data_sent", "sum");
    const httpRequestSend = new K6Metric("http_req_sending", "avg");
    const failedRequests = new K6Metric("FailedRequests", "sum");
    const httpRequests = new K6Metric("http_reqs", "sum");
    const avgHttpRequestDuration = new K6Metric("http_req_duration", "avg");
    const performanceWidget = new GraphWidget({
      title: "Performance Overview",
      left: [vus],
      right: [httpRequestDuration, httpRequestSend],
      height: 9,
      width: 16,
      liveData: true,
    });
    performanceWidget.position(0, 0);
    const vusWidget = new GaugeWidget({
      title: "VUs",
      metrics: [vus],
      height: 9,
      width: 8,
      liveData: true,
    });
    vusWidget.position(0, 16);
    const httpFailuresWidget = new SingleValueWidget({
      title: "HTTP request failures",
      metrics: [failedRequests],
      height: 5,
      width: 8,
    });
    httpFailuresWidget.position(9, 8);
    const httpRequestsWidget = new SingleValueWidget({
      title: "HTTP Requests",
      metrics: [httpRequests],
      height: 5,
      width: 8,
    });
    httpRequestsWidget.position(9, 0);
    const avgHttpRequestDurationWidget = new SingleValueWidget({
      title: "Average HTTP Request duration",
      metrics: [avgHttpRequestDuration],
      height: 5,
      width: 8,
    });
    avgHttpRequestDurationWidget.position(9, 16);
    const transferRateWidget = new GraphWidget({
      title: "Transfer Rate",
      left: [dataSend, dataReceived],
      height: 6,
      width: 12,
      liveData: true,
    });
    transferRateWidget.position(14, 0);
    const iterationDuration = new K6Metric("iteration_duration", "avg");
    const iterationsWidget = new GraphWidget({
      title: "Iterations",
      left: [iterationDuration],
      height: 6,
      width: 12,
      liveData: true,
    });
    iterationsWidget.position(14, 12);
    return [
      performanceWidget,
      vusWidget,
      httpFailuresWidget,
      httpRequestsWidget,
      avgHttpRequestDurationWidget,
      transferRateWidget,
      iterationsWidget,
    ];
  }
}

class K6Metric extends Metric {
  constructor(metricName: string, statistic: string) {
    super({
      namespace: LoadTestDashboard.METRIC_NAMESPACE,
      dimensionsMap: {
        "service.name": LoadTestDashboard.SERVICE_NAME,
      },
      metricName,
      statistic,
      period: Duration.seconds(10),
    });
  }
}
