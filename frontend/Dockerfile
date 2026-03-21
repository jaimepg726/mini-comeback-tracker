# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . ./
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
# nginx.conf uses ${BACKEND_URL}; envsubst replaces it at container start.
# Default points to backend on same host. Override: docker run -e BACKEND_URL=http://my-backend:8000
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Default backend URL — override at runtime: docker run -e BACKEND_URL=http://my-backend:8000
ENV BACKEND_URL=http://localhost:8000
EXPOSE 80
# envsubst replaces only ${BACKEND_URL}, leaving nginx's own $host/$remote_addr etc. intact
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
