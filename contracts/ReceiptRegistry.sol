// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReceiptRegistry
 * @notice On-chain proof-of-purchase for AuraGate. Circle Gateway already
 *         settles the USDC; this registry adds what settlement does not carry:
 *         which service was bought, a hash of the result, and a buyer rating.
 *         Together they make the public receipt explorer a reputation layer.
 */
contract ReceiptRegistry {
    struct Receipt {
        address payer;
        bytes32 serviceId; // keccak256(service slug)
        uint256 amount;    // USDC atomic units (6 decimals)
        bytes32 resultHash; // hash of the API response
        uint64 timestamp;
        uint8 rating;       // 0 = unrated, else 1..5
    }

    Receipt[] public receipts;

    event ReceiptRecorded(
        uint256 indexed id,
        address indexed payer,
        bytes32 indexed serviceId,
        uint256 amount,
        bytes32 resultHash
    );
    event Rated(uint256 indexed id, uint8 rating);

    /// @notice Record a paid request. Called by the seller server after delivery.
    function recordReceipt(
        address payer,
        bytes32 serviceId,
        uint256 amount,
        bytes32 resultHash
    ) external returns (uint256 id) {
        id = receipts.length;
        receipts.push(
            Receipt({
                payer: payer,
                serviceId: serviceId,
                amount: amount,
                resultHash: resultHash,
                timestamp: uint64(block.timestamp),
                rating: 0
            })
        );
        emit ReceiptRecorded(id, payer, serviceId, amount, resultHash);
    }

    /// @notice The original payer rates the service that issued this receipt.
    function rate(uint256 id, uint8 stars) external {
        require(id < receipts.length, "no receipt");
        require(stars >= 1 && stars <= 5, "1..5");
        require(receipts[id].payer == msg.sender, "not payer");
        receipts[id].rating = stars;
        emit Rated(id, stars);
    }

    function total() external view returns (uint256) {
        return receipts.length;
    }
}