const fs = require('fs');
const { Keypair } = require('@solana/web3.js');
try {
    const kpJson = fs.readFileSync('target/deploy/attention_marketplace-keypair.json', 'utf8');
    const kpArr = JSON.parse(kpJson);
    const kp = Keypair.fromSecretKey(new Uint8Array(kpArr));
    console.log(kp.publicKey.toBase58());
} catch (e) {
    console.error(e);
}
