#!/bin/bash
set -euo pipefail

BUCKET="loomzi-ssl-backup-896138901497"
REGION="ap-southeast-2"
KEY="certificates/loomzi-letsencrypt-backup.tar.gz"

CERT="/etc/letsencrypt/live/loomzi.in/fullchain.pem"
PRIVATE_KEY="/etc/letsencrypt/live/loomzi.in/privkey.pem"

if [ -s "$CERT" ] && [ -s "$PRIVATE_KEY" ]; then
    echo "Existing Loomzi SSL certificate found."

    # Certificate must remain valid for at least 7 days
    openssl x509 -in "$CERT" -noout -checkend 604800

    # Verify certificate and private key match
    CERT_HASH=$(openssl x509 -in "$CERT" -pubkey -noout | \
        openssl pkey -pubin -outform DER | sha256sum | cut -d " " -f1)

    KEY_HASH=$(openssl pkey -in "$PRIVATE_KEY" -pubout -outform DER | \
        sha256sum | cut -d " " -f1)

    if [ "$CERT_HASH" != "$KEY_HASH" ]; then
        echo "ERROR: Existing SSL certificate and private key do not match"
        exit 1
    fi

    echo "Existing Loomzi SSL certificate validated successfully."
    exit 0
fi

echo "Restoring Loomzi SSL certificate from S3..."

BACKUP=$(mktemp /tmp/loomzi-ssl-XXXXXX.tar.gz)
chmod 600 "$BACKUP"
trap 'rm -f "$BACKUP"' EXIT

aws s3 cp "s3://$BUCKET/$KEY" "$BACKUP" --region "$REGION"

tar -tzf "$BACKUP" > /dev/null

tar -xzf "$BACKUP" -C / --no-same-owner

chmod 600 /etc/letsencrypt/archive/loomzi.in/privkey*.pem

test -s "$CERT"
test -s "$PRIVATE_KEY"

# Check certificate validity for at least 7 days
openssl x509 -in "$CERT" -noout -checkend 604800

# Check certificate and private key match
CERT_HASH=$(openssl x509 -in "$CERT" -pubkey -noout | \
    openssl pkey -pubin -outform DER | sha256sum | cut -d " " -f1)

KEY_HASH=$(openssl pkey -in "$PRIVATE_KEY" -pubout -outform DER | \
    sha256sum | cut -d " " -f1)

if [ "$CERT_HASH" != "$KEY_HASH" ]; then
    echo "ERROR: SSL certificate and private key do not match"
    exit 1
fi

echo "Loomzi SSL certificate restored and validated successfully."
