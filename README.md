# Solana Hub
## Project setup
```
npm install

```

## Configure .env
```
seed=
privateKey=
```
### Run
```
node walletService.js
```


# To build smart contract 
## Install Dependencies
```
https://solana.com/docs/intro/installation
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

```

## Build token program 
```
https://www.quicknode.com/guides/solana-development/tooling/web3-2/program-clients
cargo build-bpf
anchor build
anchor deploy
```