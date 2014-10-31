#!/bin/bash

# Assumes that this repo is checked out at /home/ubuntu/react-bridge

apt-get update
apt-get -y install nodejs npm

rm -f /usr/bin/node
ln -s /usr/bin/nodejs /usr/bin/node

cd /home/ubuntu/react-bridge
npm install underscore
npm install express
npm install body-parser
npm install jsdom

cp /home/ubuntu/react-bridge/server.conf /etc/init/react-bridge.conf
chown root:root /etc/init/react-bridge.conf
chmod 644 /etc/init/react-bridge.conf

start react-bridge
