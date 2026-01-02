/**
 * CipherPaySDK - Main SDK class for browser and Node.js usage
 * 
 * This class provides a unified interface for:
 * - Wallet management
 * - Note management
 * - Deposit, transfer, and withdraw flows
 * - ZK proof generation
 * - Relayer interaction
 */

import { RelayerClient } from "./relayer/client.js";
import { deposit, DepositParams, DepositResult } from "./flows/deposit.js";
import { transfer, TransferParams, TransferResult } from "./flows/transfer.js";
import { createIdentity, deriveRecipientCipherPayPubKey } from "./keys/identity.js";
import type { Identity, CipherPayKeypair } from "./types/keys.js";
import { 
  generateDepositProof, 
  generateTransferProof, 
  generateWithdrawProof,
  generateAuditPaymentProof
} from "./circuits/index.js";

export interface SDKConfig {
  chainType: 'solana' | 'ethereum';
  rpcUrl: string;
  relayerUrl: string;
  programId?: string;
  contractAddress?: string;
  relayerApiKey?: string;
  enableCompliance?: boolean;
  enableCaching?: boolean;
  enableStealthAddresses?: boolean;
  cacheConfig?: {
    maxSize?: number;
    defaultTTL?: number;
  };
  circuitConfig?: Record<string, any>;
  auth?: {
    email?: string;
    password?: string;
    apiKey?: string;
  };
}

export class CipherPaySDK {
  private config: SDKConfig;
  public relayerClient: RelayerClient;
  
  // Placeholder properties that UI expects
  public walletProvider: any = null;
  public noteManager: any = null;
  public zkProver: any = null;
  public merkleTreeClient: any = null;

  constructor(config: SDKConfig) {
    this.config = config;
    
    // Initialize relayer client
    this.relayerClient = new RelayerClient(
      config.relayerUrl,
      config.relayerApiKey
    );

    // Initialize zkProver with all proof generation functions
    this.zkProver = {
      generateDepositProof,
      generateTransferProof,
      generateWithdrawProof,
      generateAuditPaymentProof,
    };

    console.log('[CipherPaySDK] Initialized with config:', {
      chainType: config.chainType,
      rpcUrl: config.rpcUrl,
      relayerUrl: config.relayerUrl,
      programId: config.programId
    });
  }

  // Identity management
  async createIdentity(): Promise<Identity> {
    return createIdentity();
  }

  async deriveRecipientCipherPayPubKey(keypair: CipherPayKeypair): Promise<bigint> {
    return deriveRecipientCipherPayPubKey(keypair);
  }

  // Deposit flow
  async deposit(params: DepositParams): Promise<DepositResult> {
    return deposit(params);
  }

  // Transfer flow
  async transfer(params: TransferParams): Promise<TransferResult> {
    return transfer(params);
  }

  // Withdraw flow (placeholder for now)
  async withdraw(params: any): Promise<any> {
    console.warn('[CipherPaySDK] withdraw not yet fully integrated');
    throw new Error('Withdraw flow not yet implemented in SDK class');
  }

  // Wallet methods (placeholder for now)
  getWalletInfo() {
    return {
      address: this.walletProvider?.getPublicAddress() || null
    };
  }

  // Note methods (placeholder for now)
  getNotes() {
    return this.noteManager?.getAllNotes() || [];
  }

  getSpendableNotes() {
    return this.noteManager?.getSpendableNotes() || [];
  }

  getBalance() {
    return this.noteManager?.getBalance() || 0n;
  }

  // Compliance methods (placeholder for now)
  generateComplianceReport(startTime: number, endTime: number) {
    console.warn('[CipherPaySDK] generateComplianceReport not yet implemented');
    return { startTime, endTime, transactions: [] };
  }

  // Cache methods (placeholder for now)
  getCacheStats() {
    console.warn('[CipherPaySDK] getCacheStats not yet implemented');
    return null;
  }

  // Event monitoring (placeholder for now)
  startEventMonitoring() {
    console.log('[CipherPaySDK] startEventMonitoring called (not yet implemented)');
  }

  stopEventMonitoring() {
    console.log('[CipherPaySDK] stopEventMonitoring called (not yet implemented)');
  }

  // Cleanup
  destroy() {
    console.log('[CipherPaySDK] destroy called');
    this.walletProvider = null;
    this.noteManager = null;
    this.zkProver = null;
    this.merkleTreeClient = null;
  }
}

