ARG COLLECTOR_VERSION=0.127.0
FROM otel/opentelemetry-collector-contrib:${COLLECTOR_VERSION}

COPY ./config/ /etc/config

CMD ["--config=/etc/config/otel-collector.yml"]