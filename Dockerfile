FROM node:8.0.0

RUN mkdir -p /usr/src/app
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm install

RUN apt-get update
RUN apt-get -y install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

# Install Docker from Docker Inc. repositories.
RUN curl -sSL https://get.docker.com/ | sh

EXPOSE 8080 
CMD ["npm", "start"]