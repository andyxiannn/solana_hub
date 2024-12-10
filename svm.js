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

async function getTransactionHistory(walletAddress, rpcEndpoint, options ={}){
    try {
        // Establish connection to Solana network
        const connection = new web3.Connection(rpcEndpoint || web3.clusterApiUrl('devnet'), 'confirmed' );
        const publicKey = new web3.PublicKey(walletAddress);
        const limit = options.limit || 20;
  
        // Fetch transaction signatures
        const signatures = await connection.getSignaturesForAddress(
          publicKey, 
          { 
            limit: limit,
            before: options.before
          }
        );
  
        // Fetch and process transaction details
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
            try {
                const tx = await connection.getParsedTransaction(sig.signature);
                console.log(sig)
                // Basic transaction details
                const transactionDetail = {
                    signature: sig.signature,
                    blockTime: sig.blockTime ? new Date(sig.blockTime * 1000) : null,
                    status: sig.confirmationStatus=="finalized"? 'Success' : 'Failed',
                    fee: tx?.meta?.fee,
                    type: 'unknown'
                };

                // Extract SOL transfer details
                const instructions = tx?.transaction?.message?.instructions || [];
                const transferInstruction = instructions.find(
                    (inst) => inst.program === 'system' && inst.parsed?.type === 'transfer'
                );

                if (transferInstruction) {
                const parsed = transferInstruction.parsed;
                transactionDetail.amount = parsed?.info?.lamports / 1_000_000_000; // Convert to SOL
                transactionDetail.fromAddress = parsed?.info?.source;
                transactionDetail.toAddress = parsed?.info?.destination;
                
                // Determine transaction type
                transactionDetail.type = parsed?.info?.source === publicKey.toBase58() 
                    ? 'send' 
                    : 'receive';
                }

                return transactionDetail;
            } catch (txError) {
                console.error(`Error processing transaction ${sig.signature}:`, txError);
                return null;
            }
        })
      );

      // Filter out null results
      return transactions.filter((tx) => tx !== null);
    } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw error;
    }
}

export default { 
    createWallet,
    getKeypairFromSeedPhrase,
    checkBalance,
    getWalletAccountInfo,
    sendSolTransaction,
    getTransactionHistory
}