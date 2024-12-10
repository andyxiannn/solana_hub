
import * as web3 from '@solana/web3.js';
import bs58 from "bs58"
import svmUtils from "./svm.js"
import dotenv from "dotenv"

dotenv.config()
// createSolanaWallet()
// getSolanaWallet()
// getBalance()
// getWalletInfo()
// sendNativeToken()
getWalletTransactions()

async function sendNativeToken(){
    try {
        // Replace with your sender's keypair (from private key or seed phrase)
        const seedPhrase = process.env.seed
        const senderKeypair = await svmUtils.getKeypairFromSeedPhrase(seedPhrase)
        // Recipient's public key
        const recipientPublicKey = new web3.PublicKey("4EPDwMMWE87YV4CKRTFjvUJ9CEbwY46pHPUMpHA2452F");
    
        // Amount to send (in SOL)
        const amountToSend = 0.01;
    
        // Optional: Use devnet for testing
        const devnetRPC = web3.clusterApiUrl('devnet');

        // Send transaction
        const transactionSignature = await svmUtils.sendSolTransaction(
          senderKeypair, 
          recipientPublicKey, 
          amountToSend,
          devnetRPC
        );
    
        console.log('Transaction successful!');
        console.log('Transaction Signature:', transactionSignature);
    } catch (error) {
    console.error('Transfer failed:', error);
    }
}

async function getWalletInfo(){
    const pubkey = "4EPDwMMWE87YV4CKRTFjvUJ9CEbwY46pHPUMpHA2452F"
    const walletInfo = await svmUtils.getWalletAccountInfo(pubkey)
    console.log("Wallet Info: ", walletInfo)
}
async function getBalance(){
    //get balance using pulic key
    const pubkey = "4EPDwMMWE87YV4CKRTFjvUJ9CEbwY46pHPUMpHA2452F"
    const balance = await svmUtils.checkBalance(pubkey)
    console.log("Balance PubKey:", balance);

    //get using seed phrase
    const seedPhrase = process.env.seed
    const senderKeypair = await svmUtils.getKeypairFromSeedPhrase(seedPhrase)
    const balanceSeed = await svmUtils.checkBalance(senderKeypair.publicKey)

    console.log("Balance SeedPhrase:", balanceSeed);
}
async function getSolanaWallet(){
    //get using priKey
    const pubkey = "ANe4uE1DvViXiP8LMpekHDHiYJTKgAyB9yBAMav1CSAD"
    const prikey = process.env.privateKey
    const decodedSecretKey = bs58.decode(prikey);

    // Reconstruct the Keypair
    const restoredKeypair = web3.Keypair.fromSecretKey(decodedSecretKey);
    console.log("Restored Public Key:", restoredKeypair.publicKey.toString());
    console.log("Restored Secret Key:", restoredKeypair.secretKey.toString());

    //get using seed
    const seedPhrase = process.env.seed
    const keypair = await svmUtils.getKeypairFromSeedPhrase(seedPhrase)
    console.log(keypair)
}

async function createSolanaWallet(){
    const keypair = await svmUtils.createWallet()

    console.log(keypair.publicKey.toString())
    console.log(keypair.secretKey.toString())

    //encode secret key to readable string
    const base58SecretKey = bs58.encode(keypair.secretKey);
    console.log("Base58 Secret Key:", base58SecretKey);

    /* from Secret key to get public key */
    //decode the string to array
    const decodedSecretKey = bs58.decode(base58SecretKey);

    // Reconstruct the Keypair
    const restoredKeypair = web3.Keypair.fromSecretKey(decodedSecretKey);

    console.log("Restored Public Key:", restoredKeypair.publicKey.toString());
    console.log("Restored Secret Key:", restoredKeypair.secretKey.toString());

}

async function getWalletTransactions(){
    const pubkey = "HdwHSr9ffLZrZkrm4QqTffcotDvVnTsp5JJgy6w68yKk"
    const devnetRPC = web3.clusterApiUrl('devnet');
    const txnList = await svmUtils.getTransactionHistory(pubkey, devnetRPC, {limit: 10})
    console.log(txnList)
}