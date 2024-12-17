use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    instruction::{AccountMeta, Instruction},
    system_program,
};
use std::convert::TryInto;

// Define program entrypoint
entrypoint!(process_instruction);

// Token state structure
#[derive(Clone, Debug, Default, PartialEq)]
pub struct TokenAccount {
    pub balance: u64,
    pub owner: Pubkey,
    pub mint: Pubkey,
}

// Instruction types
#[derive(Clone, Debug, PartialEq)]
pub enum TokenInstruction {
    /// Initialize a new token mint
    /// Accounts expected:
    /// 0. `[writable]` Mint account
    /// 1. `[]` Mint authority
    Initialize { 
        decimals: u8, 
        total_supply: u64 
    },
    
    /// Mint new tokens
    /// Accounts expected:
    /// 0. `[writable]` Mint account
    /// 1. `[signer]` Mint authority
    /// 2. `[writable]` Destination token account
    Mint { amount: u64 },
    
    /// Transfer tokens
    /// Accounts expected:
    /// 0. `[writable]` Source token account
    /// 1. `[writable]` Destination token account
    /// 2. `[signer]` Source account owner
    Transfer { amount: u64 },
    
    /// Burn tokens
    /// Accounts expected:
    /// 0. `[writable]` Token account
    /// 1. `[signer]` Token account owner
    Burn { amount: u64 },
}

// Instruction processing logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = TokenInstruction::unpack(instruction_data)?;

    match instruction {
        TokenInstruction::Initialize { decimals, total_supply } => {
            msg!("Instruction: Initialize Token");
            initialize_token(program_id, accounts, decimals, total_supply)
        },
        TokenInstruction::Mint { amount } => {
            msg!("Instruction: Mint Tokens");
            mint_tokens(program_id, accounts, amount)
        },
        TokenInstruction::Transfer { amount } => {
            msg!("Instruction: Transfer Tokens");
            transfer_tokens(program_id, accounts, amount)
        },
        TokenInstruction::Burn { amount } => {
            msg!("Instruction: Burn Tokens");
            burn_tokens(program_id, accounts, amount)
        },
    }
}

// Initialize token mint
fn initialize_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    decimals: u8,
    total_supply: u64,
) -> ProgramResult {
    let account = &accounts[0];
    let mint_authority = &accounts[1];

    // Validate accounts
    if !mint_authority.is_signer {
        return Err(solana_program::program_error::ProgramError::MissingRequiredSignature);
    }

    // Store token metadata
    let mut account_data = account.data.borrow_mut();
    account_data[0] = decimals;
    account_data[1..9].copy_from_slice(&total_supply.to_le_bytes());
    account_data[9..41].copy_from_slice(mint_authority.key.as_ref());

    Ok(())
}

// Mint new tokens
fn mint_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let mint_account = &accounts[0];
    let mint_authority = &accounts[1];
    let destination_account = &accounts[2];

    // Validate mint authority
    if !mint_authority.is_signer {
        return Err(solana_program::program_error::ProgramError::MissingRequiredSignature);
    }

    // Update destination account balance
    let mut destination_data = destination_account.data.borrow_mut();
    let current_balance = u64::from_le_bytes(destination_data[0..8].try_into().unwrap());
    let new_balance = current_balance.checked_add(amount)
        .ok_or(solana_program::program_error::ProgramError::ArithmeticOverflow)?;
    
    destination_data[0..8].copy_from_slice(&new_balance.to_le_bytes());

    Ok(())
}

// Transfer tokens between accounts
fn transfer_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let source_account = &accounts[0];
    let destination_account = &accounts[1];
    let owner_account = &accounts[2];

    // Validate owner
    if !owner_account.is_signer {
        return Err(solana_program::program_error::ProgramError::MissingRequiredSignature);
    }

    // Update source and destination balances
    let mut source_data = source_account.data.borrow_mut();
    let mut destination_data = destination_account.data.borrow_mut();

    let source_balance = u64::from_le_bytes(source_data[0..8].try_into().unwrap());
    let destination_balance = u64::from_le_bytes(destination_data[0..8].try_into().unwrap());

    // Check sufficient balance
    if source_balance < amount {
        return Err(solana_program::program_error::ProgramError::InsufficientFunds);
    }

    let new_source_balance = source_balance.checked_sub(amount)
        .ok_or(solana_program::program_error::ProgramError::ArithmeticOverflow)?;
    let new_destination_balance = destination_balance.checked_add(amount)
        .ok_or(solana_program::program_error::ProgramError::ArithmeticOverflow)?;

    source_data[0..8].copy_from_slice(&new_source_balance.to_le_bytes());
    destination_data[0..8].copy_from_slice(&new_destination_balance.to_le_bytes());

    Ok(())
}

// Burn tokens from an account
fn burn_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let token_account = &accounts[0];
    let owner_account = &accounts[1];

    // Validate owner
    if !owner_account.is_signer {
        return Err(solana_program::program_error::ProgramError::MissingRequiredSignature);
    }

    // Update account balance
    let mut account_data = token_account.data.borrow_mut();
    let current_balance = u64::from_le_bytes(account_data[0..8].try_into().unwrap());

    // Check sufficient balance
    if current_balance < amount {
        return Err(solana_program::program_error::ProgramError::InsufficientFunds);
    }

    let new_balance = current_balance.checked_sub(amount)
        .ok_or(solana_program::program_error::ProgramError::ArithmeticOverflow)?;
    
    account_data[0..8].copy_from_slice(&new_balance.to_le_bytes());

    Ok(())
}

// Instruction parsing
impl TokenInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, solana_program::program_error::ProgramError> {
        let (&variant, rest) = input.split_first()
            .ok_or(solana_program::program_error::ProgramError::InvalidInstructionData)?;

        Ok(match variant {
            0 => {
                // Initialize instruction
                let decimals = rest[0];
                let total_supply = u64::from_le_bytes(rest[1..9].try_into().unwrap());
                Self::Initialize { decimals, total_supply }
            },
            1 => {
                // Mint instruction
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Self::Mint { amount }
            },
            2 => {
                // Transfer instruction
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Self::Transfer { amount }
            },
            3 => {
                // Burn instruction
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Self::Burn { amount }
            },
            _ => return Err(solana_program::program_error::ProgramError::InvalidInstructionData),
        })
    }

    // Serialize instruction for client-side use
    pub fn pack(&self) -> Vec<u8> {
        match self {
            Self::Initialize { decimals, total_supply } => {
                let mut data = vec![0]; // variant
                data.push(*decimals);
                data.extend_from_slice(&total_supply.to_le_bytes());
                data
            },
            Self::Mint { amount } => {
                let mut data = vec![1]; // variant
                data.extend_from_slice(&amount.to_le_bytes());
                data
            },
            Self::Transfer { amount } => {
                let mut data = vec![2]; // variant
                data.extend_from_slice(&amount.to_le_bytes());
                data
            },
            Self::Burn { amount } => {
                let mut data = vec![3]; // variant
                data.extend_from_slice(&amount.to_le_bytes());
                data
            },
        }
    }
}