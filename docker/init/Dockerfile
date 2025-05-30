FROM alpine/git

ENV TARGET_DIR=/sources

VOLUME ${TARGET_DIR}

COPY ./entrypoint.d/ /entrypoint.d/

ENTRYPOINT ["/entrypoint.d/run.sh"]