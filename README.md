# nlt-kit based on snap-solid)

SNAP in the browser, on top of Solid.

Make sure you have Redis running.
Unfortunately, you can't use nlt-kit with the domain name 'localhost', due
to a restriction in the built-in identity provider. So please follow the
instructions from https://stackoverflow.com/questions/7580508/getting-chrome-to-accept-self-signed-localhost-certificate
(domain name: lolcathost.de) to generate the following files:

```sh
	lolcathost.de.crt
	lolcathost.de.csr
	lolcathost.de.ext
	lolcathost.de.key
	myCA.key
	myCA.pem
	myCA.srl
```

Now run:

```sh
npm install
npm test
npm run build
export NODE_EXTRA_CA_CERTS=myCA.pem
export DEBUG=*
export HTTPS=true
export PORT=443
export PUBLIC_PROTOCOL_SUFFIX=s
export DOMAIN=lolcathost.de
export TLS_CERT=lolcathost.de.crt
export TLS_KEY=lolcathost.de.key
npm start
```

Now browse to https://lolcathost.de/ (its DNS points to your machine), create a user, and log in.
