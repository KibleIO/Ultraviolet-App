FROM node:20

WORKDIR /root

COPY . /root

RUN npm install

ENTRYPOINT ["node /root/src/index.js"]