using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Decatron.Data.Encryption
{
    public class EncryptedStringConverter : ValueConverter<string, string>
    {
        public EncryptedStringConverter(string encryptionKey)
            : base(
                v => TokenEncryption.Encrypt(v, encryptionKey),
                v => TokenEncryption.Decrypt(v, encryptionKey))
        {
        }
    }
}
