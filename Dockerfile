FROM node:20

WORKDIR /root

COPY . /root

RUN npm install

CMD [ "node", "./src/index.js" ]