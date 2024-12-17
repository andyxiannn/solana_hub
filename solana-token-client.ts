import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';

class SolanaTokenClient {
  private connection: Connection;
  private programId: PublicKey;
  private payer: Keypair;

  constructor(
    rpcUrl: string = 'https://api.devnet.solana.com',
    programId?: string
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = programId 
      ? new PublicKey(programId) 
      : Keypair.generate().publicKey;
    this.payer = Keypair.generate();
  }

  // Initialize a new token mint
  async initializeToken(
    decimals: number = 9, 
    totalSupply: number = 1_000_000
  ): Promise<{ mintAccount: Keypair, mintAuthority: Keypair }> {
    const mintAccount = Keypair.generate();
    const mintAuthority = Keypair.generate();

    // Prepare instruction data
    const instructionData = Buffer.from([
      0,  // instruction variant (Initialize)
      decimals,
      ...Buffer.from(new Uint8Array(new BigUint64Array([BigInt(totalSupply)]).buffer))
    ]);

    // Create token account
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: this.payer.publicKey,
      newAccountPubkey: mintAccount.publicKey,
      lamports: await this.connection.getMinimumBalanceForRentExemption(41), // Metadata size
      space: 41,
      programId: this.programId
    });

    // Initialize token instruction
    const initializeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: mintAccount.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintAuthority.publicKey, isSigner: true, isWritable: false }
      ],
      programId: this.programId,
      data: instructionData
    });

    // Create and send transaction
    const transaction = new Transaction()
      .add(createAccountInstruction)
      .add(initializeInstruction);

    await sendAndConfirmTransaction(
      this.connection, 
      transaction, 
      [this.payer, mintAccount, mintAuthority]
    );

    return { mintAccount, mintAuthority };
  }

  // Mint tokens to an account
  async mintTokens(
    mintAccount: PublicKey,
    mintAuthority: Keypair,
    destinationAccount: PublicKey,
    amount: number
  ): Promise<string> {
    // Prepare instruction data
    const instructionData = Buffer.from([
      1,  // instruction variant (Mint)
      ...Buffer.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
    ]);

    // Create mint instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: mintAccount, isSigner: false, isWritable: true },
        { pubkey: mintAuthority.publicKey, isSigner: true, isWritable: false },
        { pubkey: destinationAccount, isSigner: false, isWritable: true }
      ],
      programId: this.programId,
      data: instructionData
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection, 
      transaction, 
      [mintAuthority]
    );

    return signature;
  }

  // Transfer tokens between accounts
  async transferTokens(
    sourceAccount: PublicKey,
    destinationAccount: PublicKey,
    owner: Keypair,
    amount: number
  ): Promise<string> {
    // Prepare instruction data
    const instructionData = Buffer.from([
      2,  // instruction variant (Transfer)
      ...Buffer.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer))
    ]);

    // Create transfer instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: sourceAccount, isSigner: false, isWritable: true },
        { pubkey: destinationAccount, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: false }
      ],
      programId: this.programId,
      data: instructionData
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection, 
      transaction, 
      [owner]
    );

    return signature;
  }
}