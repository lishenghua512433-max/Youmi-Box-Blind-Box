// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title YoumiPayoutPool
 * @notice 优秘盒盲盒专属兑付合约 — BSC链自动出款资金池
 * 
 * 用途：
 *   1. 用户NFT平台回收自动打款
 *   2. 全站分销裂变佣金自动发放
 *   3. 用户交易卖家本金自动转账
 *
 * 权限：
 *   - 唯一超级管理员(owner)为部署者钱包，普通用户无任何动用合约资产权限
 *   - 仅owner可执行payout/withdraw操作
 *
 * 充值：
 *   - 管理员往合约地址转入BNB或ERC20代币作为流动资金
 *   - 任何人可向合约转入BNB（receive/fallback）
 *
 * 提现：
 *   - 仅owner可一键提取合约内全部资产回私人钱包
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract YoumiPayoutPool {
    address public owner;

    event PayoutBNB(address indexed to, uint256 amount, string reason);
    event PayoutToken(address indexed to, uint256 amount, address indexed token, string reason);
    event WithdrawAllBNB(uint256 amount);
    event WithdrawAllToken(uint256 amount, address indexed token);
    event Deposited(address indexed from, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Accept BNB deposits
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ========== PAYOUT FUNCTIONS (Owner Only) ==========

    /**
     * @notice 向用户支付BNB（回收/佣金/卖家本金）
     * @param to 收款人地址
     * @param amount 金额(wei)
     * @param reason 用途标识: "recycle" / "commission" / "trade"
     */
    function payoutBNB(address to, uint256 amount, string calldata reason) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient BNB in pool");
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "BNB transfer failed");
        emit PayoutBNB(to, amount, reason);
    }

    /**
     * @notice 向用户支付ERC20代币（USDT/BUSD/TRX）
     * @param to 收款人地址
     * @param amount 金额(token最小单位)
     * @param token 代币合约地址
     * @param reason 用途标识
     */
    function payoutToken(address to, uint256 amount, address token, string calldata reason) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token in pool");
        require(tokenContract.transfer(to, amount), "Token transfer failed");
        emit PayoutToken(to, amount, token, reason);
    }

    /**
     * @notice 批量BNB支付
     */
    function batchPayoutBNB(address[] calldata recipients, uint256[] calldata amounts, string calldata reason) external onlyOwner {
        require(recipients.length == amounts.length, "Array length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(address(this).balance >= amounts[i], "Insufficient BNB in pool");
            (bool success, ) = payable(recipients[i]).call{value: amounts[i]}("");
            require(success, "BNB batch transfer failed");
            emit PayoutBNB(recipients[i], amounts[i], reason);
        }
    }

    /**
     * @notice 批量ERC20代币支付
     */
    function batchPayoutToken(address[] calldata recipients, uint256[] calldata amounts, address token, string calldata reason) external onlyOwner {
        require(recipients.length == amounts.length, "Array length mismatch");
        IERC20 tokenContract = IERC20(token);
        for (uint256 i = 0; i < recipients.length; i++) {
            require(tokenContract.transfer(recipients[i], amounts[i]), "Token batch transfer failed");
            emit PayoutToken(recipients[i], amounts[i], token, reason);
        }
    }

    // ========== WITHDRAW FUNCTIONS (Owner Only) ==========

    /**
     * @notice 管理员一键提取合约内全部BNB回私人钱包
     */
    function withdrawAllBNB() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB to withdraw");
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "BNB withdraw failed");
        emit WithdrawAllBNB(balance);
    }

    /**
     * @notice 管理员一键提取合约内指定ERC20代币全部余额回私人钱包
     */
    function withdrawAllToken(address token) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(tokenContract.transfer(owner, balance), "Token withdraw failed");
        emit WithdrawAllToken(balance, token);
    }

    // ========== VIEW FUNCTIONS ==========

    function getBNBBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ========== OWNERSHIP (safety) ==========

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
