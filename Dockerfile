FROM node:8.10.0-alpine

RUN apk update && apk add git

COPY . /opt/kube-icinga
RUN cd /opt/kube-icinga && \
  npm install && \
  npm run build

CMD ["node", "/opt/kube-icinga/build/main.js"]
