FROM openresty/openresty:alpine

# Install libmaxminddb and perl (required for OPM)
RUN apk add --no-cache libmaxminddb perl

# Create symlink for FFI if it doesn't exist (fix for Alpine)
RUN ln -sf /usr/lib/libmaxminddb.so.0 /usr/lib/libmaxminddb.so

# Install lua-resty-maxminddb via OPM
RUN /usr/local/openresty/bin/opm get anjia0532/lua-resty-maxminddb
