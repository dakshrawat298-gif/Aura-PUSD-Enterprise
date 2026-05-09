'use strict';

const {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} = require('@solana/web3.js');

const {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

const PUSD_DECIMALS          = 6;
const MAX_RECIPIENTS_PER_TX  = 5;
const RPC_ENDPOINT           = 'https://solana-devnet.g.alchemy.com/v2/UgmObc38dLiqCfiLFKuoX';

/**
 * Build a batch SPL token transfer transaction for all recipients.
 * The transaction is unsigned — it must be signed by the sender's Phantom wallet.
 *
 * @param {object}   params
 * @param {string}   params.senderPublicKey  - Sender's base58 Solana wallet address
 * @param {Array<{walletAddress: string, amount: number}>} params.recipientsArray
 * @param {string}   params.tokenMint        - SPL token mint address (base58)
 * @returns {Promise<string>}                - Base64-encoded serialized transaction
 */
async function createBatchTransferTransaction({ senderPublicKey, recipientsArray, tokenMint }) {
  if (!senderPublicKey)   throw new Error('senderPublicKey is required.');
  if (!tokenMint)         throw new Error('tokenMint is required.');
  if (!Array.isArray(recipientsArray) || recipientsArray.length === 0) {
    throw new Error('recipientsArray must be a non-empty array.');
  }
  if (recipientsArray.length > MAX_RECIPIENTS_PER_TX) {
    throw new Error(`Batch size ${recipientsArray.length} exceeds MAX_RECIPIENTS_PER_TX (${MAX_RECIPIENTS_PER_TX}). Split into smaller chunks.`);
  }

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const sender     = new PublicKey(senderPublicKey);
  const mint       = new PublicKey(tokenMint);

  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: sender,
  });

  const senderATA = getAssociatedTokenAddressSync(mint, sender, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  for (const recipient of recipientsArray) {
    if (!recipient.walletAddress || isNaN(recipient.amount) || recipient.amount <= 0) {
      throw new Error(`Invalid recipient entry: ${JSON.stringify(recipient)}`);
    }

    const recipientPubkey = new PublicKey(recipient.walletAddress);
    const recipientATA    = getAssociatedTokenAddressSync(
      mint,
      recipientPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // If recipient has no ATA, prepend an instruction to create it (fee paid by sender)
    const ataAccountInfo = await connection.getAccountInfo(recipientATA);
    if (!ataAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          sender,          // payer
          recipientATA,    // associatedToken
          recipientPubkey, // owner
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Convert human-readable amount to base units (6 decimals for PUSD)
    const rawAmount = BigInt(Math.round(recipient.amount * 10 ** PUSD_DECIMALS));

    transaction.add(
      createTransferCheckedInstruction(
        senderATA,       // source ATA
        mint,            // mint
        recipientATA,    // destination ATA
        sender,          // owner / authority
        rawAmount,       // amount in base units
        PUSD_DECIMALS,   // decimals
        [],              // multisigners
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Serialize without signatures — Phantom will provide the only required signature
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return serialized.toString('base64');
}

module.exports = { createBatchTransferTransaction };
