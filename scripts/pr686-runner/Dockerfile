ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS compile
RUN apt-get update && apt-get install -y --no-install-recommends bison bzip2 ca-certificates flex gcc libc6-dev make perl xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /inputs
COPY vendor/ ./vendor/
COPY SHA256SUMS ./SHA256SUMS
RUN --network=none sha256sum -c SHA256SUMS && mkdir -p /build/pg /out && tar -xjf vendor/postgresql-17.6.tar.bz2 -C /build/pg --strip-components=1 && tar -xJOf vendor/node-v24.20.0-linux-x64.tar.xz node-v24.20.0-linux-x64/bin/node > /out/node && tar -xJOf vendor/postgrest-v14.16-linux-static-x86-64.tar.xz postgrest > /out/postgrest && chmod 0755 /out/node /out/postgrest
WORKDIR /build/pg
RUN --network=none ./configure --prefix=/usr/local/pgsql --without-readline --without-zlib --without-icu --disable-rpath && make -j2 && make install
FROM ${BASE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 libstdc++6 libgcc-s1 && rm -rf /var/lib/apt/lists/* && mkdir -p /opt/pr686 /work && dpkg-query -W -f='${Package}\t${Version}\n' > /opt/pr686/os-packages.txt
COPY --from=compile /usr/local/pgsql /usr/local/pgsql
COPY --from=compile /out/node /usr/local/bin/node
COPY --from=compile /out/postgrest /usr/local/bin/postgrest
COPY probe_runtime.py /opt/pr686/probe_runtime.py
RUN --network=none printf '/usr/local/pgsql/lib\n' > /etc/ld.so.conf.d/pr686-postgresql.conf && /sbin/ldconfig && /usr/bin/python3 -I -S /opt/pr686/probe_runtime.py > /opt/pr686/runtime-measurements.json
ENV LANG=C.UTF-8 PATH=/usr/local/bin:/usr/local/pgsql/bin:/usr/bin:/bin
LABEL org.usdimpact.pr686.purpose="disposable-reduced-schema-test-runtime"
USER 65534:65534
WORKDIR /work
HEALTHCHECK NONE
ENTRYPOINT []
CMD ["/usr/bin/python3", "--version"]
