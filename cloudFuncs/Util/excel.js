/**
 * Created by lilu on 2017/10/15.
 */
import Excel from 'exceljs'
import * as errno from '../errno'
var AV = require('leanengine');

function stationAccountToExcel(req,res) {
  const {currentUser, params} = req;
  // if (!currentUser) {
  //   // no token provided
  //   throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  // }
  var Workbook = Excel.Workbook;
  var WorkbookWriter = Excel.stream.xlsx.WorkbookWriter;

  var filename = '123123';

  var wb = new WorkbookWriter({filename: filename, useSharedStrings: false, useStyles: false});
  var ws = wb.addWorksheet('blort');

  var workbook = new Excel.Workbook();
  workbook.creator = 'Me';
  workbook.lastModifiedBy = 'Her';
  workbook.created = new Date(1985, 8, 30);
  workbook.modified = new Date();
  workbook.lastPrinted = new Date(2016, 9, 27);
  workbook.views = [
    {
      x: 0, y: 0, width: 10000, height: 20000,
      firstSheet: 0, activeTab: 1, visibility: 'visible'
    }
  ]
  var sheet = workbook.addWorksheet('My Sheet', {properties:{tabColor:{argb:'FFC0000'}}});
  var worksheet =  workbook.addWorksheet('sheet', {
    pageSetup:{paperSize: 9, orientation:'landscape'}
  });
  worksheet.columns = [
    { header: 'Id', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 32 },
    { header: 'D.O.B.', key: 'dob', width: 10, outlineLevel: 1 }
  ];
  worksheet.addRow({id: 1, name: 'John Doe', dob: new Date(1970,1,1)});
  worksheet.addRow({id: 2, name: 'Jane Doe', dob: new Date(1965,1,7)});
  console.log('asasasasasasas=>',workbook)

  // var workbook = createAndFillWorkbook();
  workbook.xlsx.writeFile('xxx.xlsx')
    .then(function(item) {
      // console.log('hahahah=>',item)
      // var wb2 = new Excel.Workbook();
      // let wbfile =  wb2.xlsx.readFile('./xxx.xlsx');
      console.log('item=>',item)
      res.success( item)

              // return wb2.xlsx.readFile('../../');
      //      var file = new AV.File('xxx.txt', wbfile);
      // file.save().then((fileInfo)=>{
      //
      // })

      // file.save().then((url)=>{
      //   console.log('url=====>',url)
      //
      // })
      // done
    });

}



var excelFuncs = {
  stationAccountToExcel: stationAccountToExcel
}


module.exports = excelFuncs