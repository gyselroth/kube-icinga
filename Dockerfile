FROM node:10.15.1-alpine
COPY . /opt/kube-icinga
CMD ["node", "/opt/kube-icinga/build/main.js"]
