/*
 * Algodex Service
 * Copyright (C) 2022 Algodex VASP (BVI) Corp.
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

module.exports = function(doc) {
  const assetId = doc.data.escrowInfo.assetId;
  const historyLen = doc.data.history.length;
  const algoAmount =
    (doc.data.history[historyLen - 1].algoAmount || 0) / (Math.pow(10, 6));
  const decimals = doc.data.assetDecimals;
  const asaAmount =
    (doc.data.history[historyLen - 1].asaAmount || 0) / (Math.pow(10, decimals));

  emit(assetId, {algoAmount, asaAmount});
};