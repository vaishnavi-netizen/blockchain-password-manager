const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LockModule", (m) => {
  const lock = m.contract("Lock", [Math.floor(Date.now() / 1000) + 60], {
    value: BigInt(1000000000000000), // 0.001 ETH in wei
  });

  return { lock };
});
  