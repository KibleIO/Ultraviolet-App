FROM node:20

WORKDIR /root

COPY . /root

RUN npm install

ENTRYPOINT ["node ./src/index.js"]