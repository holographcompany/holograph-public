// /src/config/icons.ts

import { FiHome, FiFileText, FiInfo } from "react-icons/fi"; // Feather Icons
import { MdInventory, MdAccountBalance, MdHealthAndSafety, MdRealEstateAgent, MdClose, MdAddCircle, MdLibraryAdd } from "react-icons/md"; // Material Icons
import { FaPlus, FaTimes, FaUserShield, FaWifi, FaGift, FaUserFriends, FaUserEdit, FaUser, FaUsersCog } from "react-icons/fa"; // FontAwesome
import { AiOutlineShoppingCart } from "react-icons/ai"; // Ant Design Icons
//import { GiOpenTreasureChest, GiGemPendant, GiScrollQuill } from "react-icons/gi"; // Game Icons for valuables
import { FiUserPlus, FiUsers, FiEdit, FiTrash2, FiLink, FiLock, FiUser, FiSave } from "react-icons/fi"; // Import these for user roles


export const sectionIcons = {
  "vital-documents": FiFileText, // Represents document storage
  "financial-accounts": MdAccountBalance, // Bank and financial-related items
  "insurance-accounts": MdHealthAndSafety, // Insurance-related data
  "properties": MdRealEstateAgent, // Represents real estate properties
  "personal-properties": MdInventory, // Represents valuables like heirlooms, jewelry, etc.
  "social-media": FaUserFriends, // Represents social connections
  "utilities": FaWifi, // Utilities like internet, electricity, etc.
  "subscriptions": AiOutlineShoppingCart, // Represents paid subscriptions
  "reward-programs": FaGift, // Rewards and loyalty programs
  "home-services": FiHome, // Home maintenance and related services
};

// ✅ Standardized button icons
export const buttonIcons = {
  create: FaPlus, // ✅ Create new items
  save: FiSave, // ✅ Save icon
  close: FaTimes, // ✅ Close modals
  add: MdAddCircle, // ✅ Alternative for create
  "create-holograph": MdLibraryAdd, // Add Holograph 
  remove: MdClose, // ✅ Alternative for close
  link: FiLink, // link icon
  edit: FiEdit, // edit icon
  delete: FiTrash2, //delete icon
  users: FiUsers, //users icon
  lock: FiLock,
  info: FiInfo,
};

export const userIcons = {
  addPrincipal: FiUserPlus,
  addDelegate: FiUserPlus,
  transferOwnership: FaUsersCog,  // ✅ Added for ownership transfer
  "holograph-principals": FaUserEdit, // Represents a collection of planning documents
  "holograph-delegates": FaUser, // Represents secure, trusted delegation
};