FROM openresty/openresty:alpine

# Install libmaxminddb and perl (required for OPM)
RUN apk add --no-cache libmaxminddb perl

# Install lua-resty-maxminddb via OPM
RUN /usr/local/openresty/bin/opm get anjia0532/lua-resty-maxminddb
