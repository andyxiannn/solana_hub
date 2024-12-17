use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
};

// Define the program ID (will be replaced when deployed)
entrypoint!(process_instruction);

// Main program entry point
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Log a message when the program is called
    msg!("Hello, Solana!");
    
    // Basic validation
    if accounts.is_empty() {
        msg!("Error: No accounts provided");
        return Err(solana_program::program_error::ProgramError::MissingRequiredSignature);
    }

    // Always return Ok for this minimal example
    Ok(())
}