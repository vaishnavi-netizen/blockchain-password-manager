const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Lock", function () {
  let Lock, lock, owner, addr1;
  const ONE_MINUTE_IN_SECS = 60;
  const lockedAmount = ethers.parseEther("0.001");
  let unlockTime;

  beforeEach(async () => {
    const latestTime = await time.latest();
    unlockTime = latestTime + ONE_MINUTE_IN_SECS;

    Lock = await ethers.getContractFactory("Lock");
    [owner, addr1] = await ethers.getSigners();
    
    lock = await Lock.deploy(unlockTime, { value: lockedAmount });
  });

  it("Should set the correct unlock time", async function () {
    expect(await lock.unlockTime()).to.equal(unlockTime);
  });

  it("Should set the correct owner", async function () {
    expect(await lock.owner()).to.equal(owner.address);
  });

  it("Should receive and store the funds to lock", async function () {
    expect(await ethers.provider.getBalance(lock.target)).to.equal(lockedAmount);
  });

  it("Should fail if the unlockTime has not arrived", async function () {
    await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
  });

  it("Should fail if the caller is not the owner", async function () {
    // First increase time so we don't hit the time check
    await time.increaseTo(unlockTime);
    await expect(lock.connect(addr1).withdraw()).to.be.revertedWith("You aren't the owner");
  });

  it("Should transfer the funds to the owner when unlock time has arrived", async function () {
    await time.increaseTo(unlockTime);

    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await lock.withdraw();
    const receipt = await tx.wait();
    
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    
    expect(ownerBalanceAfter).to.equal(
      ownerBalanceBefore + lockedAmount - gasUsed
    );
  });
});
