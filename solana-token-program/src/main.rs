use {
    solana_program::{
        account_info::AccountInfo,
        entrypoint,
        entrypoint::ProgramResult,
        pubkey::Pubkey,
        msg,
        instruction::{AccountMeta, Instruction},
        system_instruction,
        system_program,
    },
    std::convert::TryInto,
};

// Instruction data structure for different program instructions
#[derive(Clone, Debug, PartialEq)]
pub enum TokenInstruction {
    /// Initializes a new token account
    /// Expects 3 accounts: 
    /// 0. Payer/Authority
    /// 1. New Token Account
    /// 2. System Program
    InitializeAccount,

    /// Transfers tokens between accounts
    /// Expects 4 accounts:
    /// 0. Source Token Account
    /// 1. Destination Token Account
    /// 2. Token Account Authority
    /// 3. Token Mint Account
    Transfer { amount: u64 },

    /// Mints new tokens
    /// Expects 3 accounts:
    /// 0. Token Mint Account
    /// 1. Destination Token Account
    /// 2. Mint Authority
    Mint { amount: u64 },
}

// Implement instruction data serialization
impl TokenInstruction {
    /// Packs a TokenInstruction into a byte buffer
    pub fn pack(&self) -> Vec<u8> {
        match self {
            Self::InitializeAccount => vec![0],
            Self::Transfer { amount } => {
                let mut data = vec![1];
                data.extend_from_slice(&amount.to_le_bytes());
                data
            },
            Self::Mint { amount } => {
                let mut data = vec![2];
                data.extend_from_slice(&amount.to_le_bytes());
                data
            }
        }
    }

    /// Unpacks bytes into a TokenInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        
        Ok(match variant {
            0 => Self::InitializeAccount,
            1 => {
                let amount = rest.get(..8)
                    .and_then(|slice| slice.try_into().ok())
                    .map(u64::from_le_bytes)
                    .ok_or(ProgramError::InvalidInstructionData)?;
                Self::Transfer { amount }
            },
            2 => {
                let amount = rest.get(..8)
                    .and_then(|slice| slice.try_into().ok())
                    .map(u64::from_le_bytes)
                    .ok_or(ProgramError::InvalidInstructionData)?;
                Self::Mint { amount }
            },
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

// Program entrypoint
entrypoint!(process_instruction);

/// Main program logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Parse the instruction
    let instruction = TokenInstruction::unpack(instruction_data)?;

    // Match and process different instruction types
    match instruction {
        TokenInstruction::InitializeAccount => {
            msg!("Instruction: Initialize Token Account");
            process_initialize_account(accounts)
        },
        TokenInstruction::Transfer { amount } => {
            msg!("Instruction: Transfer Tokens");
            process_transfer(accounts, amount)
        },
        TokenInstruction::Mint { amount } => {
            msg!("Instruction: Mint Tokens");
            process_mint(accounts, amount)
        }
    }
}

/// Initialize a new token account
fn process_initialize_account(accounts: &[AccountInfo]) -> ProgramResult {
    // Validate account count
    if accounts.len() != 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let payer = &accounts[0];
    let token_account = &accounts[1];
    let system_program = &accounts[2];

    // Validate system program
    if *system_program.key != system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Create account via system instruction
    let create_account_ix = system_instruction::create_account(
        payer.key,
        token_account.key,
        1_000_000, // Minimum lamports for rent exemption
        165,      // Account size for token account
        program_id
    );

    // Invoke system program to create account
    solana_program::program::invoke(
        &create_account_ix, 
        &[payer.clone(), token_account.clone(), system_program.clone()]
    )?;

    Ok(())
}

/// Transfer tokens between accounts
fn process_transfer(accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    // Validate account count
    if accounts.len() != 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let source_account = &accounts[0];
    let destination_account = &accounts[1];
    let authority = &accounts[2];
    let token_mint = &accounts[3];

    // Validate authority is signer
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Basic transfer logic (simplified)
    // In a real implementation, you'd use more robust balance checking
    let mut source_balance = source_account.try_borrow_mut_lamports()?;
    let mut dest_balance = destination_account.try_borrow_mut_lamports()?;

    if *source_balance < amount {
        return Err(ProgramError::InsufficientFunds);
    }

    *source_balance -= amount;
    *dest_balance += amount;

    Ok(())
}

/// Mint new tokens
fn process_mint(accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    // Validate account count
    if accounts.len() != 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let mint_account = &accounts[0];
    let destination_account = &accounts[1];
    let mint_authority = &accounts[2];

    // Validate mint authority is signer
    if !mint_authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Add minted amount to destination account
    let mut dest_balance = destination_account.try_borrow_mut_lamports()?;
    *dest_balance += amount;

    Ok(())
}

/// Helper function to create transfer instruction
pub fn create_transfer_instruction(
    program_id: &Pubkey,
    source_account: &Pubkey,
    destination_account: &Pubkey,
    authority: &Pubkey,
    token_mint: &Pubkey,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*source_account, false),
            AccountMeta::new(*destination_account, false),
            AccountMeta::new(*authority, true),
            AccountMeta::new(*token_mint, false),
        ],
        data: TokenInstruction::Transfer { amount }.pack(),
    }
}

// Error handling
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CustomError {
    InvalidInstruction,
    InsufficientFunds,
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}