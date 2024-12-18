import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import svmUtils from './svm.js';
import dotenv from "dotenv"
import idl from "./custom-token-program/target/idl/create_token.json" assert { type: "json" };

dotenv.config()

export class TokenProgramClient {
  // private program: anchor.Program;
  // private connection: web3.Connection;
  // private wallet: anchor.Wallet;

  
  /**
   * @param {anchor.web3.Connection} connection
   * @param {anchor.Wallet | import("@coral-xyz/anchor/dist/cjs/provider.js").Wallet} wallet
   * @param {anchor.web3.PublicKey} programId
   */
  constructor(connection, wallet, programId) {
    this.connection = connection;
    // @ts-ignore
    this.wallet = wallet;

    // Create provider
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Load the program
    this.program = new anchor.Program(
      // require("./custom-token-program/target/idl/create_token.json"),
      idl, 
      provider,
      // programId, 
    );
  }

  // Create a new mint
  /**
   * @param {anchor.web3.PublicKey | undefined} [mintAuthority]
   */
  async createMint( decimals = 9, mintAuthority ) {
    // Generate a new mint keypair
    const mint = web3.Keypair.generate();
    
    // Use wallet's pubkey as default mint authority
    const authority = mintAuthority || this.wallet.publicKey;

    // Create mint transaction
    
    const tx = await this.program.methods
      .initializeMint(decimals, authority)
      .accounts({
        mint: mint.publicKey,
        mintAuthority: authority,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    return mint.publicKey;
  }

  // Create an associated token account
  /**
   * @param {anchor.web3.PublicKey} mint
   * @param {anchor.web3.PublicKey} owner
   */
  async createTokenAccount( mint, owner ) {
    
    const tx = await this.program.methods
      .createTokenAccount()
      .accounts({
        mint,
        tokenAccount: await splToken.getAssociatedTokenAddress(mint, owner),
        payer: this.wallet.publicKey,
        owner,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return await splToken.getAssociatedTokenAddress(mint, owner);
  }

  // Mint tokens to a specific account
  async mintTokens( mint, recipient, amount ) {
    const tx = await this.program.methods
      .mintTokens(new anchor.BN(amount))
      .accounts({
        mint,
        tokenAccount: recipient,
        mintAuthority: this.wallet.publicKey,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // Transfer tokens between accounts
  /**
   * @param {web3.PublicKey} source
   * @param {web3.PublicKey} destination
   * @param {number} amount
   * @param {web3.PublicKey} authority
   */
  async transferTokens(
    
    source,
    
    destination,
    
    amount,
    
    authority
  
  ){
    const tx = await this.program.methods
      .transferTokens(new anchor.BN(amount))
      .accounts({
        from: source,
        to: destination,
        authority,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // Get token balance
  /**
   * @param {web3.PublicKey} tokenAccount
   * @param {web3.PublicKey} destination
   * @param {number} amount
   * @param {web3.PublicKey} authority
   */
  async getTokenBalance(
    
    tokenAccount
  
  ) {
    const balance = await this.connection.getTokenAccountBalance(tokenAccount);
    return BigInt(balance.value.amount);
  }
}

// Example usage
async function main() {
  // Set up connection and wallet
  const connection = new web3.Connection(
    web3.clusterApiUrl('devnet'), 
    'confirmed'
  );
  const seedPhrase = process.env.seed
  console.log(seedPhrase)
  const walletKeypair = await svmUtils.getKeypairFromSeedPhrase(seedPhrase)
  const wallet = new anchor.Wallet(walletKeypair);

  // Program ID (replace with your deployed program ID)
  const programId = new web3.PublicKey("9RbGh3uCwAFMgMoTGhSYhrJJ24VKJKqyQYvSJqt5xJeS");

  // Initialize the token program client
  const tokenClient = new TokenProgramClient(connection, wallet, programId);

  try {
    // Create a new mint
    const mint = await tokenClient.createMint(9);

    // Create a token account for the wallet
    const tokenAccount = await tokenClient.createTokenAccount(
      mint, 
      wallet.publicKey
    );

    // Mint 1000 tokens
    const mintTx = await tokenClient.mintTokens(
      mint, 
      tokenAccount, 
      1000 * 10 ** 9 // 1000 tokens with 9 decimals
    );

    console.log('Mint Transaction:', mintTx);

    // Check balance
    const balance = await tokenClient.getTokenBalance(tokenAccount);
    console.log('Token Balance:', balance.toString());
  } catch (error) {
    console.error('Error in token program:', error);
  }
}

// Uncomment to run
main();

export default TokenProgramClient;