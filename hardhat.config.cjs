require("dotenv").config();

const PK = process.env.DEPLOYER_PRIVATE_KEY;

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    arcTestnet: {
      url: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
      accounts: PK && !/^0x0+$/.test(PK) ? [PK] : [],
    },
  },
};