function emailValid()
{
var regexEmail = /^[a-z]{1,30}[0-9]{6}@[m][e][c][h][y][d]\.[a][c]\.[i][n]$/;
var email = document.getElementById("inputEmail");

if (regexEmail.test(email.value)) {
    return true;
} else {
    alert("Error! Invalid email...Please enter MEC email")
    return false;
}
}
