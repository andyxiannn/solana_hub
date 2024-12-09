import * as web3 from '@solana/web3.js';
import bs58 from "bs58"
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
  
async function createWallet(){
    let keypair = web3.Keypair.generate();
    return keypair
}

async function getKeypairFromSeedPhrase(seedPhrase){
    try {
      // Validate seed phrase
      if (!bip39.validateMnemonic(seedPhrase)) {
        throw new Error('Invalid seed phrase');
      }
  
      // Generate seed from mnemonic
      const seed = await bip39.mnemonicToSeed(seedPhrase);
  
      // Derive HD path (using Solana's derivation path)
      const path = "m/44'/501'/0'/0'";
      const { key } = derivePath(path, seed.toString('hex'));
  
      // Create keypair from seed
      const keypair = web3.Keypair.fromSeed(key.slice(0, 32));
  
      return keypair;
    } catch (error) {
      console.error('Error generating keypair:', error);
      throw error;
    }
}

async function checkBalance(pubKey) {
    try {
        // Replace with your wallet's public key
        const publicKey = new web3.PublicKey(pubKey);
    
        // Optional: Use a specific RPC endpoint
        const customRPC = 'https://api.devnet.solana.com'; // or your preferred RPC
    
        const connection = new web3.Connection(customRPC || web3.clusterApiUrl('devnet'), 'confirmed' );
    
        // Get wallet balance in lamports
        const balanceLamports = await connection.getBalance(publicKey);
    
        // Convert lamports to SOL (1 SOL = 10^9 lamports)
        const balanceSOL = balanceLamports / web3.LAMPORTS_PER_SOL;

        return balanceSOL.toFixed(4);
    } catch (error) {
      console.error('Failed to check balance:', error);
    }
}

async function getWalletAccountInfo(publicKey) {
    try {
        const customRPC = 'https://api.devnet.solana.com'; // or your preferred RPC
        const connection = new web3.Connection(customRPC || web3.clusterApiUrl('devnet'), 'confirmed' );
        // Get full account information
        const accountInfo = await connection.getParsedAccountInfo(new web3.PublicKey(publicKey));
      
        return accountInfo;
    } catch (error) {
        console.error('Error fetching account info:', error);
        throw error;
    }
}

async function sendSolTransaction(fromKeypair, toPublicKey, amountInSol, rpcEndpoint ){
    try {
        // Establish connection to Solana network
        const connection = new web3.Connection(rpcEndpoint || web3.clusterApiUrl('devnet'), 'confirmed' );
        const transaction = new web3.Transaction().add(
            web3.SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPublicKey,
            lamports: amountInSol * web3.LAMPORTS_PER_SOL ,
            }),
        );
 
        const signature = await web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [fromKeypair],
        );

        if (signature.err) {
            throw new Error('Transaction failed');
        }
    
        return signature;
    } catch (error) {
      console.error('Error sending SOL:', error);
      throw error;
    }
}

export default { 
    createWallet,
    getKeypairFromSeedPhrase,
    checkBalance,
    getWalletAccountInfo,
    sendSolTransaction
}