import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { sendAndConfirmTransaction } from '@solana/web3.js';
import * as web3 from "@solana/web3.js";
// import { Anchor } from './token-program/target/types/anchor';
import idl from "./token-program/target/idl/anchor.json" assert { type: "json" };
import svmUtils from './svm.js';
import dotenv from "dotenv"

dotenv.config()

  // Configure the client to use the local cluster.
    const connection = new web3.Connection(
        web3.clusterApiUrl('devnet'), 
        'confirmed'
    );
    const seedPhrase = process.env.seed
    console.log(seedPhrase)
    const wallet = await svmUtils.getKeypairFromSeedPhrase(seedPhrase)
    console.log(wallet.publicKey.toBase58())
    const provider = new anchor.AnchorProvider(connection, wallet,{
        commitment: "confirmed",
    });

    // Load the program
    const program = new anchor.Program(
        idl, 
        provider,
    );    

    const TOKEN_2022_PROGRAM_ID = new anchor.web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    const ATA_PROGRAM_ID = new anchor.web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

    const tokenName = 'TestToken';
    const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('token-2022-token'), wallet.publicKey.toBytes(), Buffer.from(tokenName)],
        program.programId,
    );
    const [payerATA] = anchor.web3.PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBytes(), TOKEN_2022_PROGRAM_ID.toBytes(), mint.toBytes()],
        ATA_PROGRAM_ID,
    );

    const receiver = anchor.web3.Keypair.generate();

    const [receiverATA] = anchor.web3.PublicKey.findProgramAddressSync(
        [receiver.publicKey.toBytes(), TOKEN_2022_PROGRAM_ID.toBytes(), mint.toBytes()],
        ATA_PROGRAM_ID,
    );
    createToken()

    async function createToken() {
        // await connection.requestAirdrop(receiver.publicKey, 1000000000);
        // await connection.requestAirdrop(wallet.publicKey, 1000000000);
        const tx = new anchor.web3.Transaction();

        const ix = await program.methods
        .createToken(tokenName)
        .accounts({
            signer: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

        tx.add(ix);

        const sig = await sendAndConfirmTransaction(program.provider.connection, tx, [wallet.payer]);
        console.log('Your transaction signature', sig);
    }

    async function InitializePayerATA() {
        const tx = new anchor.web3.Transaction();

        const ix = await program.methods
        .createAssociatedTokenAccount()
        .accounts({
            tokenAccount: payerATA,
            mint: mint,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

        tx.add(ix);

        const sig = await sendAndConfirmTransaction(program.provider.connection, tx, [wallet.payer]);
        console.log('Your transaction signature', sig);
    }

    /*
    // This instruction is included only as a reference, but is not required to run this test, because we are using "init" in the program's transfer instruction. The create_associated_token_account instruction on the program is provided as a reference as well.
    it("Initialize receiver ATA", async () => {
        const tx = new anchor.web3.Transaction();
        const ix = await program.methods
        .createAssociatedTokenAccount()
        .accounts({
            tokenAccount: receiverATA,
            mint: mint,
            signer: receiver.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ATA_PROGRAM_ID,
        })
        .signers([receiver])
        .instruction();
        tx.add(ix);
        const sig = await anchor.web3.sendAndConfirmTransaction(
        program.provider.connection,
        tx,
        [receiver]
        );
        console.log("Your transaction signature", sig);
    });
    */

    async function MintTokenToPayer() {
        const tx = new anchor.web3.Transaction();

        const ix = await program.methods
        .mintToken(new anchor.BN(200000000))
        .accounts({
            mint: mint,
            signer: wallet.publicKey,
            receiver: payerATA,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

        tx.add(ix);

        const sig = await sendAndConfirmTransaction(program.provider.connection, tx, [wallet.payer]);
        console.log('Your transaction signature', sig);
    }

    // Using init in the transfer instruction, as init if needed is bot working with Token 2022 yet.
    async function transferToken() {
        const tx = new anchor.web3.Transaction();

        const ix = await program.methods
        .transferToken(new anchor.BN(100))
        .accounts({
            mint: mint,
            signer: wallet.publicKey,
            from: payerATA,
            to: receiver.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            toAta: receiverATA,
        })
        .instruction();

        tx.add(ix);

        const sig = await sendAndConfirmTransaction(program.provider.connection, tx, [wallet.payer]);
        console.log('Your transaction signature', sig);
    }